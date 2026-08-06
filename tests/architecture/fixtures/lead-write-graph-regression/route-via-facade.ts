import { deliverValidatedLead } from "./lead-delivery-facade";

export async function POST() {
  await deliverValidatedLead({} as never);
}
