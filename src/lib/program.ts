import { notFound, redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { defaultPathForRole, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMarketingSettings, syncStoreCouponSales } from "@/lib/influencers";

// Portal do programa Experts & Creators: só para quem é Expert/Creator ativo.
export async function requireProgramMember() {
  const user = await requireUser();
  if (!user.influencer) {
    // Parceiro sem cadastro no programa: o portal é a casa dele, então não há para onde redirecionar.
    if (user.role === UserRole.PARTNER) notFound();
    redirect(defaultPathForRole(user.role));
  }
  await syncStoreCouponSales();
  const [influencer, settings] = await Promise.all([
    prisma.influencer.findUniqueOrThrow({ where: { id: user.influencer.id } }),
    getMarketingSettings(),
  ]);
  return { user, influencer, settings, showCommission: settings.showCommission };
}
