import type { ThemeTokens } from "../themes/theme.templates";

export type EmailGenerationInput = {
  type: string;
  objective: string;
  brandTone: string;
  logoUrl: string;
  theme: ThemeTokens;
};

export type GeneratedEmail = {
  subject: string;
  body: string;
};

export interface EmailGenerator {
  generate(input: EmailGenerationInput): Promise<GeneratedEmail>;
}

export class MockEmailGenerator implements EmailGenerator {
  async generate(input: EmailGenerationInput): Promise<GeneratedEmail> {
    return {
      subject: `${input.type}: ${input.objective}`,
      body: `
        <div style="font-family:${input.theme.typography.fontFamily};background:${input.theme.colors.background};color:${input.theme.colors.foreground};padding:24px;">
          <img src="${input.logoUrl}" alt="logo" style="height:48px" />
          <h1 style="font-family:${input.theme.typography.headingFamily};">${input.objective}</h1>
          <p>Tono: ${input.brandTone}</p>
          <p>Hola, este es un email generado para ${input.type}.</p>
          <a style="display:inline-block;padding:10px 16px;background:${input.theme.colors.primary};color:#fff;text-decoration:none;border-radius:${input.theme.radii.md};">Ver detalle</a>
        </div>
      `.trim(),
    };
  }
}
