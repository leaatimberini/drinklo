import { validate } from "class-validator";
import { UpsertEmailDomainDto } from "./dto/domain-email.dto";

describe("UpsertEmailDomainDto", () => {
  it("rejects invalid provider type", async () => {
    const dto = new UpsertEmailDomainDto();
    (dto as any).providerType = "INVALID";
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
