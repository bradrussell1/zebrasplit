/**
 * The FAQ now lives in @bunktab/core so the marketing site and the mobile app
 * read the same answers. This file stays as the site's import path.
 */
export { faqSections, faqItems, faqById, homepageFaqIds, homepageFaq, faqPlainAnswer } from "@bunktab/core";
export type { FaqItem, FaqSection } from "@bunktab/core";
