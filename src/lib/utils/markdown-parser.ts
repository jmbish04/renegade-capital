/**
 * @fileoverview Utility to parse lightweight LLM markdown into HTML.
 */

export function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) {
    return "";
  }

  // 1. Process inline formatting before structural elements
  let processed = markdown.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  processed = processed.replace(/(?<!\*)\*(?!\*)(.*?)\*/g, "<em>$1</em>");
  processed = processed.replace(/_(.*?)_/g, "<em>$1</em>");
  processed = processed.replace(/`(.*?)`/g, "<code>$1</code>");

  const lines = processed.split("\n");
  const result: string[] = [];
  
  let inList = false;
  let listType = "";

  // 2. Process structural blocks line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Handle empty lines (closes lists, acts as natural breaks)
    if (line === "") {
      if (inList) {
        result.push(`</${listType}>`);
        inList = false;
      }
      continue;
    }

    // Handle Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      if (inList) {
        result.push(`</${listType}>`);
        inList = false;
      }
      const level = headerMatch[1].length;
      result.push(`<h${level}>${headerMatch[2]}</h${level}>`);
      continue;
    }

    // Handle Ordered Lists
    const orderedListMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (orderedListMatch) {
      if (!inList) {
        inList = true;
        listType = "ol";
        result.push("<ol>");
      } else if (listType !== "ol") {
        result.push(`</${listType}>`);
        listType = "ol";
        result.push("<ol>");
      }
      result.push(`  <li>${orderedListMatch[2]}</li>`);
      continue;
    }

    // Handle Unordered Lists
    const unorderedListMatch = line.match(/^[-*]\s+(.*)/);
    if (unorderedListMatch) {
      if (!inList) {
        inList = true;
        listType = "ul";
        result.push("<ul>");
      } else if (listType !== "ul") {
        result.push(`</${listType}>`);
        listType = "ul";
        result.push("<ul>");
      }
      result.push(`  <li>${unorderedListMatch[1]}</li>`);
      continue;
    }

    // Standard paragraphs
    if (inList) {
      result.push(`</${listType}>`);
      inList = false;
    }
    result.push(`<p>${line}</p>`);
  }

  // Cleanup dangling open lists
  if (inList) {
    result.push(`</${listType}>`);
  }

  return result.join("\n");
}
