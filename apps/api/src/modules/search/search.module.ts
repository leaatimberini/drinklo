import { Module } from "@nestjs/common";
import { SearchService } from "./search.service";
import { SearchController, SearchAdminController } from "./search.controller";

@Module({
  controllers: [SearchController, SearchAdminController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
