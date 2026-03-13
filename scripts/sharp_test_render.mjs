import fs from 'fs';

async function runTest() {
  const payload = JSON.parse(fs.readFileSync('test_sharp_render.json', 'utf8'));
  
  console.log('--- EXECUTING SHARP TEST: OPTION C RENDER ---');
  console.log('Target:', 'https://backend-production-d3da.up.railway.app/api/foundry/render');
  
  try {
    const response = await fetch('https://backend-production-d3da.up.railway.app/api/foundry/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer Heravej_22'
      },
      body: JSON.stringify(payload)
    });

    console.log('Response Status:', response.status);
    
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      const filename = `test_output_${Date.now()}.pptx`;
      fs.writeFileSync(filename, Buffer.from(buffer));
      console.log(`✅ TEST SUCCESSFUL: Document rendered and saved as ${filename}`);
      console.log(`File size: ${buffer.byteLength} bytes`);
    } else {
      const result = await response.json();
      console.log('❌ TEST FAILED:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('❌ FATAL ERROR during test execution:', error);
  }
}

runTest();
