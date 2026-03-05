import * as pdfjsLib from "pdfjs-dist";

// Configure the worker using the CDN for compatibility with Next.js bundling.
// The worker runs PDF parsing off the main thread.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extracts all text content from a PDF file.
 * @param file - The PDF File object from a file input or drop event.
 * @returns The concatenated text from all pages.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Join items with spaces, preserving reading order
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
        pages.push(pageText);
    }

    return pages.join("\n\n").trim();
}
