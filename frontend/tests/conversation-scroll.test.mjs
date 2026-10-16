import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import useConversationScroll from '../src/hooks/useConversationScroll.js';
let tree;
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; });
function setup() {
  let scrollTop = 0;
  const node = { scrollHeight: 2000, clientHeight: 400, get scrollTop() { return scrollTop; }, set scrollTop(value) { scrollTop = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)); } };
  let onScroll;
  function Conversation({ messages, scope = 'group:1' }) {
    const state = useConversationScroll(messages, scope, 1);
    onScroll = state.rememberScrollPosition;
    return React.createElement('div', { ref: state.transcript });
  }
  const render = (messages, scope) => act(() => {
    const element = React.createElement(Conversation, { messages, scope });
    if (tree) tree.update(element); else tree = Renderer.create(element, { createNodeMock: () => node });
  });
  return { node, render, scroll: top => { node.scrollTop = top; onScroll(); } };
}
const message = (id, senderId = 2) => ({ id, senderId });
test('opening a populated conversation shows its latest message', () => {
  const c = setup(); c.render([]); c.render([message(1), message(2)]);
  assert.equal(c.node.scrollTop, 1600);
});
test('polling and incoming messages keep the reader at their place in history', () => {
  const c = setup(); const rows = [message(1), message(2)]; c.render(rows); c.scroll(200);
  c.render([...rows]); assert.equal(c.node.scrollTop, 200);
  c.node.scrollHeight = 2100; c.render([...rows, message(3)]); assert.equal(c.node.scrollTop, 200);
});
test('incoming messages follow the bottom when the reader is already there', () => {
  const c = setup(); c.render([message(1)]); c.scroll(1600); c.node.scrollHeight = 2100;
  c.render([message(1), message(2)]); assert.equal(c.node.scrollTop, 1700);
});
test('sending a message shows the sent message even after reading older history', () => {
  const c = setup(); c.render([message(1)]); c.scroll(200); c.node.scrollHeight = 2100;
  c.render([message(1), message(2, 1)]); assert.equal(c.node.scrollTop, 1700);
});
test('loading an older page preserves the visible message position', () => {
  const c = setup(); c.render([message(2), message(3, 1)]); c.scroll(100); c.node.scrollHeight = 2600;
  c.render([message(1), message(2), message(3, 1)]); assert.equal(c.node.scrollTop, 700);
});
test('switching conversations resets to the latest messages', () => {
  const c = setup(); c.render([message(1)]); c.scroll(0);
  c.render([message(10)], 'group:2'); assert.equal(c.node.scrollTop, 1600);
});
