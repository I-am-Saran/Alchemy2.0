/**
 * Microsoft SSO Service
 * Handles Microsoft Azure AD authentication using MSAL
 */

import { PublicClientApplication } from '@azure/msal-browser';

// Microsoft Azure AD configuration
// These should be set via environment variables
const MS_CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID || '';
const MS_TENANT_ID = import.meta.env.VITE_MS_TENANT_ID || 'common';

// Validate configuration
export function isSSOConfigured() {
  return !!MS_CLIENT_ID && MS_CLIENT_ID.trim() !== '';
}

const MSAL_CONFIG = {
  auth: {
    clientId: MS_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${MS_TENANT_ID}`,
    redirectUri: window.location.origin + '/login',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

// Scopes required for authentication
const LOGIN_SCOPES = ['User.Read', 'openid', 'profile', 'email'];

let msalInstance = null;

/**
 * Initialize MSAL instance
 */
export function initializeMSAL() {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(MSAL_CONFIG);
    msalInstance.initialize();
  }
  return msalInstance;
}

/**
 * Get MSAL instance
 */
export function getMSALInstance() {
  if (!msalInstance) {
    return initializeMSAL();
  }
  return msalInstance;
}

/**
 * Sign in with Microsoft SSO
 * Returns access token if successful
 */
export async function signInWithMicrosoft() {
  // Validate configuration before attempting login
  if (!isSSOConfigured()) {
    const error = new Error('Microsoft SSO is not configured. Please set VITE_MS_CLIENT_ID and VITE_MS_TENANT_ID in your .env file.');
    error.code = 'SSO_NOT_CONFIGURED';
    throw error;
  }
  
  try {
    const msal = getMSALInstance();
    
    // Check if user is already signed in
    const accounts = msal.getAllAccounts();
    if (accounts.length > 0) {
      // Try to get token silently
      try {
        const response = await msal.acquireTokenSilent({
          scopes: LOGIN_SCOPES,
          account: accounts[0],
        });
        return response.accessToken;
      } catch (silentError) {
        // If silent token acquisition fails, do interactive login
        const response = await msal.loginPopup({
          scopes: LOGIN_SCOPES,
        });
        return response.accessToken;
      }
    } else {
      // No accounts, do interactive login
      const response = await msal.loginPopup({
        scopes: LOGIN_SCOPES,
      });
      return response.accessToken;
    }
  } catch (error) {
    console.error('Microsoft SSO sign-in error:', error);
    
    // Provide helpful error messages
    if (error.message && error.message.includes('AADSTS900144')) {
      throw new Error('Microsoft SSO configuration error: Client ID is missing. Please check your VITE_MS_CLIENT_ID environment variable.');
    }
    
    throw error;
  }
}

/**
 * Sign out from Microsoft SSO
 */
export async function signOutFromMicrosoft() {
  try {
    const msal = getMSALInstance();
    const accounts = msal.getAllAccounts();
    
    if (accounts.length > 0) {
      await msal.logoutPopup({
        account: accounts[0],
      });
    }
  } catch (error) {
    console.error('Microsoft SSO sign-out error:', error);
    // Continue even if sign-out fails
  }
}

/**
 * Get current Microsoft account
 */
export function getMicrosoftAccount() {
  try {
    const msal = getMSALInstance();
    const accounts = msal.getAllAccounts();
    return accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.error('Error getting Microsoft account:', error);
    return null;
  }
}

