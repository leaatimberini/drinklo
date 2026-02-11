import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";

export class UpdateThemeDto {
  @ApiProperty({ required: false, enum: ["A", "B", "C"] })
  @IsOptional()
  @IsIn(["A", "B", "C"])
  storefrontTheme?: "A" | "B" | "C";

  @ApiProperty({ required: false, enum: ["A", "B", "C"] })
  @IsOptional()
  @IsIn(["A", "B", "C"])
  adminTheme?: "A" | "B" | "C";
}
