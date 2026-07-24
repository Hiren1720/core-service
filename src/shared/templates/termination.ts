import { emailLayout } from "./layout";

interface TerminationTemplateProps {
  employeeName: string;
  terminationDate: string;
  reason: string;
  managerName: string;
  managerDesignation: string;
}

export const terminationTemplate = ({
  employeeName,
  terminationDate,
  reason,
  managerName,
  managerDesignation,
}: TerminationTemplateProps) =>
  emailLayout(
    "Notice of Employment Termination",
    `
<p>Dear <strong>${employeeName}</strong>,</p>

<p>
This letter serves as formal notification that your employment with the organization
will be terminated effective <strong>${terminationDate}</strong>.
</p>

<p>
<strong>Reason for Termination:</strong><br/>
${reason}
</p>

<p>
We request you to complete all pending assignments, hand over company assets,
documents, and responsibilities, and coordinate with the HR department to
complete the necessary exit formalities before your relieving date.
</p>

<p>
Any pending salary, reimbursements, or other applicable dues will be processed
as per the company's policies and applicable laws.
</p>

<p>
We appreciate the efforts and contributions you have made during your tenure
with the organization and wish you success in your future endeavors.
</p>

<br/>

<p>
Kind Regards,<br/>
<strong>${managerName}</strong><br/>
${managerDesignation}
</p>
`,
  );
