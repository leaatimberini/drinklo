import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsString, MinLength } from "class-validator";

const themeIds = ["A", "B", "C"] as const;

export class InstallerBootstrapDto {
  @ApiProperty()
  @IsString()
  companyName!: string;

  @ApiProperty()
  @IsEmail()
  adminEmail!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  adminPassword!: string;

  @ApiProperty({ enum: themeIds, default: "A" })
  @IsIn(themeIds)
  themeAdmin!: "A" | "B" | "C";

  @ApiProperty({ enum: themeIds, default: "A" })
  @IsIn(themeIds)
  themeStorefront!: "A" | "B" | "C";
}
