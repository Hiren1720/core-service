import { emailLayout } from "./layout";

interface PromotionTemplateProps {
  employeeName: string;
  newDesignation: string;
  effectiveFrom: string;
  managerName: string;
  managerDesignation: string;
}

export const promotionTemplate = ({
  employeeName,
  newDesignation,
  effectiveFrom,
  managerName,
  managerDesignation,
}: PromotionTemplateProps) =>
  emailLayout(
    "Congratulations on Your Promotion",
    `
<p>Dear <strong>${employeeName}</strong>,</p>

<p>
We are pleased to inform you that based on your consistent performance,
dedication, and valuable contribution to the organization, you have been
promoted to
<strong>${newDesignation}</strong>, effective from
<strong>${effectiveFrom}</strong>.
</p>

<p>
Your commitment to quality work, teamwork, and professional growth has been
recognized and appreciated by the management.
</p>

<p>
In your new role, you will be entrusted with greater responsibilities and are
expected to continue demonstrating the same level of excellence and leadership.
</p>

<p>
Further details regarding your revised compensation and responsibilities will
be shared separately by the HR department.
</p>

<p>
Congratulations on your well-deserved promotion. We look forward to your
continued success with the organization.
</p>

<br/>

<p>
Kind Regards,<br/>
<strong>${managerName}</strong><br/>
${managerDesignation}
</p>
`,
  );
