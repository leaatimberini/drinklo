import { Injectable } from "@nestjs/common";
import { DataGovernanceService } from "./data-governance.service";

@Injectable()
export class DataGovernanceJob {
  constructor(private readonly governance: DataGovernanceService) {}

  async runDailyForCompany(companyId: string) {
    return this.governance.runPurge(companyId, undefined, "cron");
  }
}
