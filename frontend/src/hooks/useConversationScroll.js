import { useLayoutEffect, useRef } from 'react';

// Scroll only the transcript, keeping the composer and page navigation still.
export default function useConversationScroll(messages, conversationKey, userId) {
  const transcript = useRef(null), previous = useRef(null), following = useRef(true);
  useLayoutEffect(() => {
    const node = transcript.current;
    if (!node) { previous.current = null; return; }
    const old = previous.current;
    const first = messages[0]?.id, last = messages.at(-1)?.id;
    const opening = !old || old.key !== conversationKey || !old.count;
    const prepended = !opening && messages.length > old.count && first !== old.first && last === old.last;
    if (prepended) node.scrollTop += node.scrollHeight - old.height;
    else if (opening || (last !== old.last && (following.current || messages.at(-1)?.senderId === userId))) node.scrollTop = node.scrollHeight;
    following.current = node.scrollHeight - node.clientHeight - node.scrollTop <= 64;
    previous.current = { key: conversationKey, first, last, count: messages.length, height: node.scrollHeight };
  }, [messages, conversationKey, userId]);
  function rememberScrollPosition() {
    const node = transcript.current;
    if (node) following.current = node.scrollHeight - node.clientHeight - node.scrollTop <= 64;
  }
  return { transcript, rememberScrollPosition };
}
