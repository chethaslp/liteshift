#!/usr/bin/env node

// Simple test script to verify the deployment queue system
// Run this with: node test-queue.js

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testDeploymentQueue() {
  console.log('🚀 Testing Deployment Queue System...\n');

  try {
    // Test 1: Queue a deployment
    console.log('1. Testing GitHub deployment queueing...');
    const deployResponse = await fetch(`${BASE_URL}/api/manager`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'deploy-git',
        appName: 'test-queue-app',
        repository: 'https://github.com/vercel/next.js.git',
        branch: 'canary',
        startCommand: 'npm start',
        installCommand: 'npm install',
        buildCommand: 'npm run build'
      }),
    });

    const deployData = await deployResponse.json();
    
    if (deployData.success) {
      console.log('✅ Deployment queued successfully!');
      console.log('   Queue ID:', deployData.data.queueId);
      console.log('   Message:', deployData.data.message);
      
      const queueId = deployData.data.queueId;
      
      // Test 2: Check queue status
      console.log('\n2. Testing queue status check...');
      const statusResponse = await fetch(`${BASE_URL}/api/manager?action=status&queueId=${queueId}`);
      const statusData = await statusResponse.json();
      
      if (statusData.success) {
        console.log('✅ Queue status retrieved successfully!');
        console.log('   Status:', statusData.data.status.status);
        console.log('   App Name:', statusData.data.status.app_name);
        console.log('   Type:', statusData.data.status.type);
      } else {
        console.log('❌ Failed to get queue status:', statusData.error);
      }
      
      // Test 3: Get all queue items
      console.log('\n3. Testing queue overview...');
      const queueResponse = await fetch(`${BASE_URL}/api/manager?action=queue`);
      const queueData = await queueResponse.json();
      
      if (queueData.success) {
        console.log('✅ Queue overview retrieved successfully!');
        console.log('   Total items in queue:', queueData.data.queue.length);
        queueData.data.queue.forEach(item => {
          console.log(`   - ${item.app_name} (${item.status}) - Queue ID: ${item.id}`);
        });
      } else {
        console.log('❌ Failed to get queue overview:', queueData.error);
      }
      
      // Test 4: Monitor deployment progress
      console.log('\n4. Monitoring deployment progress...');
      let attempts = 0;
      const maxAttempts = 10;
      
      const monitorProgress = async () => {
        if (attempts >= maxAttempts) {
          console.log('⚠️  Monitoring stopped after', maxAttempts, 'attempts');
          return;
        }
        
        attempts++;
        
        const response = await fetch(`${BASE_URL}/api/manager?action=status&queueId=${queueId}`);
        const data = await response.json();
        
        if (data.success) {
          const status = data.data.status.status;
          console.log(`   Attempt ${attempts}: Status is "${status}"`);
          
          if (status === 'completed') {
            console.log('✅ Deployment completed successfully!');
            return;
          } else if (status === 'failed') {
            console.log('❌ Deployment failed:', data.data.status.error_message);
            return;
          } else if (status === 'queued' || status === 'building') {
            // Continue monitoring
            setTimeout(monitorProgress, 2000);
          }
        } else {
          console.log('❌ Failed to check status:', data.error);
        }
      };
      
      setTimeout(monitorProgress, 1000);
      
    } else {
      console.log('❌ Failed to queue deployment:', deployData.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  testDeploymentQueue();
}

module.exports = { testDeploymentQueue };
