const modulePath = "@/lib/lead-pipeline/process-lead";

export async function POST() {
  const leadPipeline = await import(modulePath);
  await leadPipeline.processValidatedInquiry({} as never);
}
