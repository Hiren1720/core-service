import { emailLayout } from "./layout";

interface ResignationAcceptedTemplateProps {
  employeeName: string;
  lastWorkingDay: string;
  managerName: string;
  managerDesignation: string;
}

export const resignationAcceptedTemplate = ({
  employeeName,
  lastWorkingDay,
  managerName,
  managerDesignation,
}: ResignationAcceptedTemplateProps) =>
  emailLayout(
    "Resignation Accepted",
    `
<p>Dear <strong>${employeeName}</strong>,</p>

<p>
This is to formally inform you that your resignation has been reviewed and accepted by the organization.
</p>

<p>
Your last working day will be <strong>${lastWorkingDay}</strong>, as discussed and mutually agreed upon.
</p>

<p>
We sincerely appreciate your valuable contributions and the dedication you have shown during your time with us.
</p>

<p>
We wish you continued growth, success, and the very best in your future professional journey.
</p>

<p>
Please coordinate with the HR team to complete the necessary exit formalities and handover process before your last working day.
</p>

<br/>

<p>
Kind Regards,<br/>
<strong>${managerName}</strong><br/>
${managerDesignation}
</p>
`,
  );
