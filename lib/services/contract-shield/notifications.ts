import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"
import { emailService } from "@/lib/services/email.service"

export async function sendOverrideNotification(
  userId: string,
  scanId: string,
  overrideId: string,
  action: string,
  reason: string,
) {
  const notification = await prisma.contractShieldNotification.create({
    data: {
      scanId,
      recipientId: userId,
      notificationType: "EMAIL",
      status: "PENDING",
      subject: "Action Required: Contract Review Status Update",
      message: `An admin has updated your Contract Shield review status.\n\nAction: ${action}\nReason: ${reason}\n\nPlease log in to review and acknowledge this change.`,
    },
  })

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (user?.email) {
      await emailService.sendNotification(
        user.email,
        "Override Acknowledgment Required",
        `An override action (${action}) has been requested for your contract. Reason: ${reason}`,
        "Review Override",
        `${process.env['NEXT_PUBLIC_APP_URL']}/buyer/contracts`
      )

      await prisma.contractShieldNotification.update({
        where: { id: notification.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      })

      logger.info("Override notification sent", {
        notificationId: notification.id,
        userId,
        scanId,
      })
    }
  } catch (error) {
    await prisma.contractShieldNotification.update({
      where: { id: notification.id },
      data: {
        status: "FAILED",
        failedReason: error instanceof Error ? error.message : "Unknown error",
      },
    })

    logger.error("Failed to send override notification", {
      notificationId: notification.id,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }

  return notification
}

export async function sendStatusChangeNotification(scanId: string, oldStatus: string, newStatus: string) {
  const scan = await prisma.contractShieldScan.findUnique({
    where: { id: scanId },
    include: {
      selectedDeal: {
        include: {
          buyer: true,
          dealer: true,
        },
      },
    },
  })

  if (!scan?.selectedDeal) return

  // Notify buyer
  if (scan.selectedDeal.buyer?.id) {
    const notification = await prisma.contractShieldNotification.create({
      data: {
        scanId,
        recipientId: scan.selectedDeal.buyer.id,
        notificationType: "EMAIL",
        status: "PENDING",
        subject: `Contract Review Update: ${newStatus.replace("_", " ")}`,
        message: `Your contract review status has changed from ${oldStatus} to ${newStatus}.\n\nLog in to view the details.`,
      },
    })

    try {
      if (scan.selectedDeal.buyer.email) {
        await emailService.sendNotification(
          scan.selectedDeal.buyer.email,
          "Contract Shield Status Changed",
          `Your contract shield status has changed from ${oldStatus} to ${newStatus}.`,
          "Review Contract",
          `${process.env['NEXT_PUBLIC_APP_URL']}/buyer/contracts`
        )

        await prisma.contractShieldNotification.update({
          where: { id: notification.id },
          data: { status: "SENT", sentAt: new Date() },
        })
      }
    } catch (error) {
      await prisma.contractShieldNotification.update({
        where: { id: notification.id },
        data: {
          status: "FAILED",
          failedReason: error instanceof Error ? error.message : "Unknown error",
        },
      })
    }
  }

  // Notify dealer
  if (scan.selectedDeal.dealer?.id) {
    const notification = await prisma.contractShieldNotification.create({
      data: {
        scanId,
        recipientId: scan.selectedDeal.dealer.id,
        notificationType: "EMAIL",
        status: "PENDING",
        subject: `Contract Review Update: ${newStatus.replace("_", " ")}`,
        message: `A contract review status has changed from ${oldStatus} to ${newStatus}.`,
      },
    })

    try {
      if (scan.selectedDeal.dealer.email) {
        await emailService.sendNotification(
          scan.selectedDeal.dealer.email,
          "Contract Shield Status Changed",
          `Contract shield status has changed from ${oldStatus} to ${newStatus}.`,
          "Review Contract",
          `${process.env['NEXT_PUBLIC_APP_URL']}/dealer/contracts`
        )

        await prisma.contractShieldNotification.update({
          where: { id: notification.id },
          data: { status: "SENT", sentAt: new Date() },
        })
      }
    } catch (error) {
      await prisma.contractShieldNotification.update({
        where: { id: notification.id },
        data: {
          status: "FAILED",
          failedReason: error instanceof Error ? error.message : "Unknown error",
        },
      })
    }
  }
}
