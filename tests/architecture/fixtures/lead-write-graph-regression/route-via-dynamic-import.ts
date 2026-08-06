export async function POST() {
  const leadPipeline = await import("@/lib/lead-pipeline/process-lead");
  await leadPipeline.processValidatedInquiry({} as never);
}
