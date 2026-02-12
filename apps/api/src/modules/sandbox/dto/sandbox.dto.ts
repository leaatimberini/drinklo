import { IsBoolean } from "class-validator";

export class SetSandboxModeDto {
  @IsBoolean()
  sandboxMode!: boolean;
}
