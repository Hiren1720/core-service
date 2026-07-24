export const emailLayout = (title: string, body: string) => `
<!DOCTYPE html>
<html>
...
<header>
CRM Logo
</header>

<h2>${title}</h2>

${body}

<footer>
This is an automated email.
</footer>

</html>
`;
