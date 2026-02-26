import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

const DANGEROUS_PATTERN = /<\s*script|<\s*img|<\s*iframe|javascript:/i;

@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    void metadata;
    return this.sanitize(value);
  }

  private sanitize(value: unknown): unknown {
    if (typeof value === "string") {
      if (DANGEROUS_PATTERN.test(value)) {
        throw new BadRequestException("Invalid input");
      }
      return value.trim();
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }
    if (value && typeof value === "object") {
      const output: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        output[key] = this.sanitize(val);
      }
      return output;
    }
    return value;
  }
}
