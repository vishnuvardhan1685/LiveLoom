const WebSocket = require('ws');

async function runAllVerification() {
  console.log('=== Starting Full Specification & Integration Verification ===');
  
  // 1. Auth Test (Login or Signup)
  let token;
  const loginRes = await fetch('http://localhost:4000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'spec_verify@liveloom.dev', password: 'password123' })
  }).then(r => r.json());

  if (loginRes.token) {
    token = loginRes.token;
    console.log('1. Auth (Login): PASSED');
  } else {
    const signupRes = await fetch('http://localhost:4000/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `spec_${Date.now()}@liveloom.dev`, password: 'password123', name: 'Spec Tester' })
    }).then(r => r.json());
    token = signupRes.token;
    console.log('1. Auth (Signup):', token ? 'PASSED' : 'FAILED');
  }

  // 2. Room Creation
  const roomRes = await fetch('http://localhost:4000/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name: 'Spec Verification Room', description: 'Testing room' })
  }).then(r => r.json());
  console.log('2. Create Room:', roomRes.id ? 'PASSED' : 'FAILED', roomRes.id);
  const roomId = roomRes.id;

  // 3. Get WS Ticket
  const ticketRes = await fetch(`http://localhost:4000/rooms/${roomId}/ws-ticket`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());
  console.log('3. WS Ticket:', ticketRes.ticket ? 'PASSED' : 'FAILED', ticketRes.ticket);

  // 4. Connect WS with ticket
  const wsUrl = `ws://localhost:4000/ws/${roomId}?ticket=${ticketRes.ticket}`;
  const ws = new WebSocket(wsUrl);

  const connected = await new Promise((resolve) => {
    ws.on('open', () => resolve(true));
    ws.on('error', (err) => resolve(false));
    setTimeout(() => resolve(false), 3000);
  });
  console.log('4. WS Connection:', connected ? 'PASSED' : 'FAILED');
  ws.close();

  // 5. Create Invite
  const inviteRes = await fetch(`http://localhost:4000/rooms/${roomId}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ role: 'editor', maxUses: 5, expiresAt: new Date(Date.now() + 86400000).toISOString() })
  }).then(r => r.json());
  console.log('5. Create Invite:', inviteRes.token ? 'PASSED' : 'FAILED', inviteRes.token);

  if (token && roomRes.id && ticketRes.ticket && connected && inviteRes.token) {
    console.log('\n✅ ALL VERIFICATION CHECKS PASSED 100%! System is fully functional.');
  } else {
    console.log('\n❌ Verification failed.');
  }
}

runAllVerification().catch(console.error);
