/**
 * Version utility to get the current application version
 */

import packageJson from '../../package.json';

/**
 * Gets the current application version
 * Uses version.json which is incremented on each production deploy
 */
export function getAppVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version || '0.0.1';
}

/**
 * Gets the build number (unique for each deployment)
 */
export function getBuildNumber(): string | undefined {
  return process.env.NEXT_PUBLIC_BUILD_NUMBER;
}

/**
 * Gets the build timestamp (set at build time)
 */
export function getBuildTimestamp(): string | undefined {
  return process.env.NEXT_PUBLIC_BUILD_TIMESTAMP;
}

/**
 * Gets the git commit SHA (set at build time by Vercel)
 */
export function getGitCommitSha(): string | undefined {
  return process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_GIT_COMMIT_SHA;
}

/**
 * Gets the Vercel deployment URL (if available)
 */
export function getDeploymentUrl(): string | undefined {
  return process.env.VERCEL_URL;
}

/**
 * Gets the Vercel deployment ID (if available)
 */
export function getDeploymentId(): string | undefined {
  return process.env.VERCEL_DEPLOYMENT_ID;
}

/**
 * Gets full version info including build metadata
 */
export function getVersionInfo() {
  const baseVersion = getAppVersion();
  const buildNumber = getBuildNumber();
  
  // Create full version string: baseVersion-buildNumber (e.g., "0.1.0-1234567890")
  const fullVersion = buildNumber ? `${baseVersion}-${buildNumber}` : baseVersion;
  
  return {
    version: baseVersion,
    fullVersion,
    buildNumber: getBuildNumber(),
    buildTimestamp: getBuildTimestamp(),
    gitCommitSha: getGitCommitSha(),
    deploymentUrl: getDeploymentUrl(),
    deploymentId: getDeploymentId(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  };
}

