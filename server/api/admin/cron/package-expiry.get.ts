import { runPackageExpiryCron } from "~~/server/utils/packageExpiryCron";

export default defineEventHandler(runPackageExpiryCron);
