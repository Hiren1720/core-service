import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";

export const generateInvoicePdf = async (html: string, outputPath: string) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // A4 viewport
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 1,
    });

    // Load HTML
    await page.setContent(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />

          <style>
            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: white;
            }

            body {
              font-family: Arial, Helvetica, sans-serif;
            }

            @page {
              size: A4;
              margin: 0;
            }

            #invoice-slip {
              width: 794px;
              min-height: 1123px;
              margin: 0 auto;
              box-shadow: none !important;
            }

            img {
              max-width: 100%;
            }
          </style>
        </head>

        <body>
          ${html}
        </body>
      </html>
      `,
      {
        waitUntil: "load",
      },
    );

    // Wait for images
    await page.evaluate(async () => {
      const images = Array.from(document.images);

      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();

          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        }),
      );
    });

    const uploadDir = path.join(process.cwd(), "public", "uploads", "invoice");
    await fs.mkdir(uploadDir, { recursive: true });

    const fileName = `${outputPath}.pdf`;
    const filePath = path.join(uploadDir, fileName);

    // Generate PDF
    await page.pdf({
      path: filePath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });

    return `/uploads/invoice/${fileName}`;
  } finally {
    await browser.close();
  }
};
