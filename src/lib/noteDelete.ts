import { OWNER, REPO, BRANCH, TOKEN_KEY, API_ROOT, ghHeaders, validateToken } from './adminAuth';

/**
 * Wires up every `.note-delete` button on the page. Shared because both the
 * /notes list and each note's permalink render the same control.
 *
 * The buttons ship hidden; a stored token only reveals them. The real
 * authorization check runs against GitHub when delete is actually clicked.
 */
export function initNoteDelete(onDeleted?: (button: HTMLButtonElement) => void): void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.note-delete'));
  if (buttons.length === 0) return;

  if (localStorage.getItem(TOKEN_KEY)) {
    for (const button of buttons) button.removeAttribute('hidden');
  }

  for (const button of buttons) {
    button.addEventListener('click', async () => {
      const path = button.dataset.path;
      if (!path) return;
      if (!confirm('이 메모를 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;

      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        alert('로그인이 만료되었습니다. /write에서 다시 로그인해주세요.');
        return;
      }

      button.disabled = true;
      button.textContent = '삭제 중…';
      try {
        await validateToken(token);

        const getRes = await fetch(`${API_ROOT}/repos/${OWNER}/${REPO}/contents/${path}`, {
          headers: ghHeaders(token),
        });
        if (!getRes.ok) throw new Error(`http-${getRes.status}`);
        const file = (await getRes.json()) as { sha: string };

        const delRes = await fetch(`${API_ROOT}/repos/${OWNER}/${REPO}/contents/${path}`, {
          method: 'DELETE',
          headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `fix: delete note "${path.split('/').pop()?.replace(/\.md$/, '')}"`,
            sha: file.sha,
            branch: BRANCH,
          }),
        });
        if (!delRes.ok) throw new Error(`http-${delRes.status}`);

        alert('삭제되었습니다. 배포가 끝나면 목록에서 사라집니다.');
        onDeleted?.(button);
      } catch {
        alert('삭제에 실패했습니다.');
        button.disabled = false;
        button.textContent = '🗑 삭제';
      }
    });
  }
}
