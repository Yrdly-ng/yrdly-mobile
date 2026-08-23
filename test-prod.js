const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://yoiyqxtpmxnrrbqqidcs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvaXlxeHRwbXhucnJicXFpZGNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMDY5OTksImV4cCI6MjA3NTY4Mjk5OX0.xL4t7V9BiaOxtdGrYqJMBXKLtP6JTwdU2akNwPP8t-w'
);

async function test() {
  const { data: { user }, error: signupError } = await supabase.auth.signUp({
    email: 'test' + Date.now() + '@yrdly.com',
    password: 'password123',
    options: {
      data: { name: 'Test User', phone: '08012345678' }
    }
  });

  if (signupError) {
    console.log("Signup error:", signupError);
    return;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  
  if (!token) {
    console.log("No token", sessionError);
    return;
  }

  console.log("Got token!");

  const res = await fetch('https://app.yrdly.ng/api/payment/initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      itemId: 'some-fake-item-id',
      buyerId: user.id,
      sellerId: user.id,
      price: 1030,
      buyerEmail: user.email,
      itemType: 'post'
    })
  });

  const text = await res.text();
  console.log("Response status:", res.status);
  console.log("Response body:", text);
}

test();
