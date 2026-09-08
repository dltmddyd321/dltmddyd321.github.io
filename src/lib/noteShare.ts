/**
 * Wires up every `.note-share` button on the page. Shared because both the
 * /notes list and each note's permalink render the same control — mirrors
 * the post page's share button (PostLayout), but each button carries its own
 * target URL via `data-share-path` rather than using `location.href`: on the
 * /notes list, the current page is /notes while each note's real address is
 * /notes/<id>, so sharing has to resolve per-button, not from the page URL.
 */
export function initNoteShare(): void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.note-share'));

  for (const button of buttons) {
    button.addEventListener('click', async () => {
      const path = button.dataset.sharePath;
      if (!path) return;

      const shareData = {
        title: button.dataset.shareTitle ?? document.title,
        url: new URL(path, location.origin).href,
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch {
          // User cancelled the share sheet — not an error.
        }
        return;
      }

      try {
        await navigator.clipboard.writeText(shareData.url);
        const original = button.textContent;
        button.textContent = '링크 복사됨!';
        setTimeout(() => {
          button.textContent = original;
        }, 1500);
      } catch {
        alert(shareData.url);
      }
    });
  }
}
