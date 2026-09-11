import { getSystemPrompt, getAnalysisPrompt } from '../ai/systemPrompt';
import { scoreToCategory, type Language } from '../types/medical';

export interface AIAnalysisRequest {
  medications: string[];
  symptoms?: string;
  notes?: string;
  language: Language;
  verifiedContext?: string;
  verificationAvailable?: boolean;
}

interface NIMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export class AIService {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.NIM_API_KEY || '';
    this.model = process.env.NIM_MODEL || 'stepfun-ai/step-3.7-flash';
    this.baseUrl = process.env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  }

  private async callNIM(messages: NIMMessage[], jsonMode = true): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: 0.3,
      max_tokens: 4000,
    };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NIM API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content || '{}';
  }

  async analyzeMedications(request: AIAnalysisRequest) {
    const systemPrompt = getSystemPrompt(request.language);
    const userPrompt = getAnalysisPrompt(
      request.medications,
      request.symptoms,
      request.notes,
      request.verifiedContext ? { context: request.verifiedContext } : undefined,
      request.language
    );

    const messages: NIMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const verificationMessage =
      request.language === 'ar'
        ? 'التحقق الطبي المباشر غير متاح حالياً.'
        : 'Live medical verification is currently unavailable.';

    let retries = 3;
    while (retries > 0) {
      try {
        const response = await this.callNIM(messages);
        const parsed = this.parseJSONResponse(response);
        const score = this.clampScore(Number(parsed.score) || 70);
        const riskLevel = this.determineRiskLevel(score);
        const safetyCategory = scoreToCategory(score);

        return {
          score,
          riskLevel,
          safetyCategory,
          interactions: parsed.interactions || [],
          sideEffects: parsed.sideEffects || [],
          foodInteractions: parsed.foodInteractions || [],
          safetyConcerns: parsed.safetyConcerns || [],
          recommendations: parsed.recommendations || [],
          verificationAvailable: request.verificationAvailable ?? false,
          verificationMessage:
            request.verificationAvailable === false ? verificationMessage : undefined,
          disclaimer:
            request.language === 'ar'
              ? 'هذا التحليل لأغراض إعلامية فقط وليس بديلاً عن المشورة الطبية المهنية. استشر طبيبك أو صيدليك دائماً.'
              : 'This analysis is for informational purposes only and is not a substitute for professional medical advice.',
        };
      } catch (error) {
        retries--;
        if (retries <= 0) {
          console.error('AI analysis failed:', error);
          return this.getFallbackResponse(request.language, request.verificationAvailable);
        }
        await new Promise((r) => setTimeout(r, 1000 * (4 - retries)));
      }
    }

    return this.getFallbackResponse(request.language, request.verificationAvailable);
  }

  async extractMedicationInfo(
    imageData: string
  ): Promise<Array<{ name: string; dosage: string; activeIngredient: string; warnings?: string[] }>> {
    const messages: NIMMessage[] = [
      {
        role: 'system',
        content:
          'You are a medication information extraction system. Extract ALL medications from medication packages or prescriptions. Return valid JSON array only.',
      },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageData } },
          {
            type: 'text',
            text: `Extract medication names, dosages, active ingredients, and warning labels. Return JSON array:
[{"name":"","dosage":"","activeIngredient":"","warnings":[]}]. If unreadable, return [].`,
          },
        ],
      },
    ];

    try {
      const response = await this.callNIM(messages, false);
      return this.parseExtractions(response);
    } catch (error) {
      console.error('Vision extraction failed:', error);
      return [];
    }
  }

  private parseJSONResponse(response: string): Record<string, unknown> {
    try {
      return JSON.parse(response);
    } catch {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          return {};
        }
      }
      return {};
    }
  }

  private parseExtractions(
    response: string
  ): Array<{ name: string; dosage: string; activeIngredient: string; warnings?: string[] }> {
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed.filter((item) => item?.name) : [];
    } catch {
      const match = response.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          return Array.isArray(parsed) ? parsed.filter((item) => item?.name) : [];
        } catch {
          return [];
        }
      }
      return [];
    }
  }

  private clampScore(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private determineRiskLevel(score: number): 'low' | 'moderate' | 'high' {
    if (score >= 75) return 'low';
    if (score >= 50) return 'moderate';
    return 'high';
  }

  private getFallbackResponse(language: Language, verificationAvailable?: boolean) {
    const disclaimer =
      language === 'ar'
        ? 'هذا التحليل لأغراض إعلامية فقط وليس بديلاً عن المشورة الطبية المهنية.'
        : 'This analysis is for informational purposes only and is not a substitute for professional medical advice.';

    const verificationMessage =
      language === 'ar'
        ? 'التحقق الطبي المباشر غير متاح حالياً.'
        : 'Live medical verification is currently unavailable.';

    return {
      score: 70,
      riskLevel: 'low' as const,
      safetyCategory: scoreToCategory(70),
      interactions: [],
      sideEffects: [],
      foodInteractions: [],
      safetyConcerns:
        language === 'ar' ? ['تعذر إكمال التحليل الآلي بالكامل'] : ['Unable to complete full automated analysis'],
      recommendations:
        language === 'ar'
          ? ['يرجى استشارة طبيبك أو صيدليك']
          : ['Please consult your doctor or pharmacist'],
      verificationAvailable: verificationAvailable ?? false,
      verificationMessage: verificationAvailable === false ? verificationMessage : undefined,
      disclaimer,
    };
  }
}

export const aiService = new AIService();
