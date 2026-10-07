const test = require('node:test');
const assert = require('node:assert/strict');
const Y = require('yjs');
const { issueTicket, consumeTicket } = require('../src/services/ticket.service');
const { getRole, setRole, removeRoleMap } = require('../src/services/roomstate.service');

test('1. Role Permission Checks', async (t) => {
  const roomId = 'room_unit_test_123';
  const userIdEditor = 'user_editor_456';
  const userIdViewer = 'user_viewer_789';

  t.after(() => {
    removeRoleMap(roomId);
  });

  // Initially unknown user/room returns null
  assert.equal(getRole(roomId, userIdEditor), null);

  // Set roles in memory map
  setRole(roomId, userIdEditor, 'editor');
  setRole(roomId, userIdViewer, 'viewer');

  assert.equal(getRole(roomId, userIdEditor), 'editor');
  assert.equal(getRole(roomId, userIdViewer), 'viewer');
  assert.equal(getRole(roomId, 'non_existent_user'), null);
});

test('2. WS Ticket Generation & Verification', async () => {
  const payload = { userId: 'user_test_99', roomId: 'room_test_88' };

  // Issue ticket
  const ticket = issueTicket(payload);
  assert.ok(typeof ticket === 'string');
  assert.equal(ticket.split('.').length, 3);

  // Consume valid ticket
  const decoded = consumeTicket(ticket);
  assert.ok(decoded);
  assert.equal(decoded.userId, payload.userId);
  assert.equal(decoded.roomId, payload.roomId);

  // Reject tampered ticket signature
  const parts = ticket.split('.');
  const tamperedTicket = `${parts[0]}.${parts[1]}.invalid_signature_hash`;
  assert.equal(consumeTicket(tamperedTicket), null);

  // Reject malformed ticket
  assert.equal(consumeTicket('malformed.ticket'), null);
  assert.equal(consumeTicket(''), null);
});

test('3. Yjs CRDT Convergence Test', async () => {
  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();

  const text1 = doc1.getText('code');
  const text2 = doc2.getText('code');

  // Doc 1 initial edit
  text1.insert(0, 'function main() { return "hello"; }');

  // Sync Doc 1 state to Doc 2
  const update1 = Y.encodeStateAsUpdate(doc1);
  Y.applyUpdate(doc2, update1);

  assert.equal(text2.toString(), 'function main() { return "hello"; }');

  // Concurrent edits on both docs
  text1.insert(0, '// Header comment\n');
  text2.insert(text2.length, '\n// Footer comment');

  // Cross-sync updates
  const update1_2 = Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2));
  const update2_1 = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc1));

  Y.applyUpdate(doc2, update1_2);
  Y.applyUpdate(doc1, update2_1);

  // Verify byte-level and text-level convergence
  assert.equal(text1.toString(), text2.toString());
  assert.equal(
    text1.toString(),
    '// Header comment\nfunction main() { return "hello"; }\n// Footer comment'
  );
});
