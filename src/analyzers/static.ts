import { encoding_for_model, TiktokenModel } from 'tiktoken';

export class StaticAnalyzer {
  // Tiktoken encoders cached per model
  private encoders: Map<string, ReturnType<typeof encoding_for_model>> = new Map();

  /**
   * Free all cached tiktoken WASM encoders to release native memory.
   */
  dispose(): void {
    for (const encoder of this.encoders.values()) {
      encoder.free();
    }
    this.encoders.clear();
  }

  /**
   * Get accurate token count using tiktoken
   */
  getTokenCount(text: string, model: string = 'gpt-4'): number {
    try {
      // Map model to tiktoken model name
      let tiktokenModel: TiktokenModel = 'gpt-4';
      if (model.includes('gpt-3.5')) {
        tiktokenModel = 'gpt-3.5-turbo';
      } else if (model.includes('gpt-4')) {
        tiktokenModel = 'gpt-4';
      }
      let encoder = this.encoders.get(tiktokenModel);
      if (!encoder) {
        encoder = encoding_for_model(tiktokenModel);
        this.encoders.set(tiktokenModel, encoder);
      }
      return encoder.encode(text).length;
    } catch {
      // Fallback to estimation
      return Math.ceil(text.length / 4);
    }
  }
}
