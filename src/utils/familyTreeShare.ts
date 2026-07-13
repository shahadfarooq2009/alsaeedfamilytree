import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export type ShareAccessMode = 'view' | 'edit';

const INVITE_STORAGE_PREFIX = 'family-tree-invite-token';
const ACCESS_STORAGE_PREFIX = 'family-tree-share-access';

function storageKey(prefix: string, familyId: number): string {
  return `${prefix}:${familyId}`;
}

function randomToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 18);
}

export function getFamilyTreeShareUrl(): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function getOrCreateInviteToken(familyId: number): string {
  const key = storageKey(INVITE_STORAGE_PREFIX, familyId);
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const token = randomToken();
  window.localStorage.setItem(key, token);
  return token;
}

export function loadShareAccessMode(familyId: number): ShareAccessMode {
  const stored = window.localStorage.getItem(storageKey(ACCESS_STORAGE_PREFIX, familyId));
  return stored === 'edit' ? 'edit' : 'view';
}

export function saveShareAccessMode(familyId: number, mode: ShareAccessMode): void {
  window.localStorage.setItem(storageKey(ACCESS_STORAGE_PREFIX, familyId), mode);
}

export function buildInviteLink(familyId: number, access: ShareAccessMode): string {
  const url = new URL(getFamilyTreeShareUrl());
  url.searchParams.set('invite', getOrCreateInviteToken(familyId));
  url.searchParams.set('access', access);
  return url.toString();
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export function buildShareMessage(familyName: string | null | undefined, url: string): string {
  const title = familyName?.trim() ? `شجرة عائلة ${familyName.trim()}` : 'شجرة العائلة';
  return `${title}\n${url}`;
}

export async function shareViaNative(
  familyName: string | null | undefined,
  url: string,
): Promise<'shared' | 'unsupported' | 'cancelled' | 'failed'> {
  if (!navigator.share) return 'unsupported';

  try {
    await navigator.share({
      title: familyName?.trim() ? `شجرة عائلة ${familyName.trim()}` : 'شجرة العائلة',
      text: 'تفضل بمشاهدة شجرة العائلة',
      url,
    });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'cancelled';
    }
    return 'failed';
  }
}

export function openWhatsAppShare(
  familyName: string | null | undefined,
  url: string,
): void {
  const text = encodeURIComponent(buildShareMessage(familyName, url));
  window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
}

export function openEmailShare(
  familyName: string | null | undefined,
  url: string,
): void {
  const title = familyName?.trim() ? `شجرة عائلة ${familyName.trim()}` : 'شجرة العائلة';
  const subject = encodeURIComponent(title);
  const body = encodeURIComponent(buildShareMessage(familyName, url));
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\u0600-\u06FF\s-]+/g, '').trim().replace(/\s+/g, '-') || 'family-tree';
}

async function captureTreeElement(element: HTMLElement): Promise<HTMLCanvasElement> {
  const panel = element.querySelector('.member-focus-panel');
  const previousPanelDisplay = panel instanceof HTMLElement ? panel.style.display : null;
  if (panel instanceof HTMLElement) {
    panel.style.display = 'none';
  }

  try {
    return await html2canvas(element, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#f3efe4',
      scale: Math.min(2, window.devicePixelRatio || 1.5),
      logging: false,
      ignoreElements: (node) => node.classList?.contains('member-focus-panel') ?? false,
    });
  } finally {
    if (panel instanceof HTMLElement && previousPanelDisplay != null) {
      panel.style.display = previousPanelDisplay;
    }
  }
}

export async function exportTreeAsPng(
  element: HTMLElement,
  familyName: string | null | undefined,
): Promise<void> {
  const canvas = await captureTreeElement(element);
  const filename = `${sanitizeFilename(familyName ?? 'family-tree')}.png`;
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function exportTreeAsPdf(
  element: HTMLElement,
  familyName: string | null | undefined,
): Promise<void> {
  const canvas = await captureTreeElement(element);
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  const x = (pageWidth - width) / 2;
  const y = (pageHeight - height) / 2;

  pdf.setFontSize(14);
  pdf.text(familyName?.trim() ? `شجرة عائلة ${familyName.trim()}` : 'شجرة العائلة', margin, 10);
  pdf.addImage(imgData, 'PNG', x, y + 4, width, height - 4);
  pdf.save(`${sanitizeFilename(familyName ?? 'family-tree')}.pdf`);
}
