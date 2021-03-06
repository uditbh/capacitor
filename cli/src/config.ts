import { accessSync, readFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import kleur from 'kleur';
import prompts from 'prompts';

import { logFatal, readJSON } from './common';
import { CliConfig, ExternalConfig, OS, PackageJson } from './definitions';

let Package: PackageJson;
let ExtConfig: ExternalConfig;

export class Config implements CliConfig {
  windows = {
    androidStudioPath:
      'C:\\Program Files\\Android\\Android Studio\\bin\\studio64.exe',
  };

  linux = {
    androidStudioPath: '/usr/local/android-studio/bin/studio.sh',
  };

  android = {
    name: 'android',
    minVersion: '21',
    platformDir: '',
    webDir: 'app/src/main/assets/public',
    webDirAbs: '',
    resDir: 'app/src/main/res',
    resDirAbs: '',
    assets: {
      templateName: 'android-template',
      pluginsFolderName: 'capacitor-cordova-android-plugins',
      templateDir: '',
      pluginsDir: '',
    },
  };

  ios = {
    name: 'ios',
    minVersion: '11.0',
    cordovaSwiftVersion: '5.0',
    platformDir: '',
    webDir: 'public',
    webDirAbs: '',
    nativeProjectName: 'App',
    assets: {
      templateName: 'ios-template',
      pluginsFolderName: 'capacitor-cordova-ios-plugins',
      templateDir: '',
      pluginsDir: '',
    },
  };

  web = {
    name: 'web',
  };

  cli = {
    binDir: '',
    rootDir: '',
    assetsName: 'assets',
    assetsDir: '',
    package: Package,
    os: OS.Unknown,
  };

  app = {
    rootDir: '',
    appId: '',
    appName: '',
    webDir: 'www',
    webDirAbs: '',
    package: Package,
    windowsAndroidStudioPath:
      'C:\\Program Files\\Android\\Android Studio\\bin\\studio64.exe',
    linuxAndroidStudioPath: '',
    extConfigName: 'capacitor.config.json',
    extConfigFilePath: '',
    extConfig: ExtConfig,
    bundledWebRuntime: false,
    plugins: {},
    server: {
      cleartext: false,
    },
  };

  knownPlatforms: string[] = [];
  knownCommunityPlatforms = ['electron'];

  constructor(os: string, currentWorkingDir: string, cliBinDir: string) {
    this.initOS(os);
    this.initCliConfig(cliBinDir);

    try {
      this.initAppConfig(resolve(currentWorkingDir));
      this.loadExternalConfig();
      this.mergeConfigData();

      // Post-merge
      this.initAndroidConfig();
      this.initIosConfig();
      this.initWindowsConfig();
      this.initLinuxConfig();

      this.knownPlatforms.push(this.web.name);
    } catch (e) {
      logFatal(`Unable to load config ${e.stack ? e.stack : e}`);
    }
  }

  initOS(os: string) {
    switch (os) {
      case 'darwin':
        this.cli.os = OS.Mac;
        break;
      case 'win32':
        this.cli.os = OS.Windows;
        break;
      case 'linux':
        this.cli.os = OS.Linux;
        break;
    }
  }

  private initCliConfig(cliBinDir: string) {
    this.cli.binDir = cliBinDir;
    this.cli.rootDir = join(cliBinDir, '../');
    this.cli.assetsDir = join(this.cli.rootDir, this.cli.assetsName);
    this.cli.package = loadPackageJson(this.cli.rootDir);
  }

  private initAppConfig(currentWorkingDir: string) {
    this.app.rootDir = currentWorkingDir;
    this.app.package = loadPackageJson(currentWorkingDir);
  }

  async updateAppPackage() {
    this.app.package = await readJSON(
      resolve(this.app.rootDir, 'package.json'),
    );
  }

  private initAndroidConfig() {
    this.knownPlatforms.push(this.android.name);
    this.android.platformDir = resolve(this.app.rootDir, this.android.name);
    this.android.assets.templateDir = resolve(
      this.cli.assetsDir,
      this.android.assets.templateName,
    );
    this.android.assets.pluginsDir = resolve(
      this.cli.assetsDir,
      this.android.assets.pluginsFolderName,
    );
    this.android.webDirAbs = resolve(
      this.android.platformDir,
      this.android.webDir,
    );
    this.android.resDirAbs = resolve(
      this.android.platformDir,
      this.android.resDir,
    );
  }

  private initIosConfig() {
    this.knownPlatforms.push(this.ios.name);
    this.ios.platformDir = resolve(this.app.rootDir, this.ios.name);
    this.ios.assets.templateDir = resolve(
      this.cli.assetsDir,
      this.ios.assets.templateName,
    );
    this.ios.assets.pluginsDir = resolve(
      this.cli.assetsDir,
      this.ios.assets.pluginsFolderName,
    );
    this.ios.webDirAbs = resolve(
      this.ios.platformDir,
      this.ios.nativeProjectName,
      this.ios.webDir,
    );
    if (
      this.app.extConfig &&
      this.app.extConfig.ios &&
      this.app.extConfig.ios.cordovaSwiftVersion
    ) {
      this.ios.cordovaSwiftVersion = this.app.extConfig.ios.cordovaSwiftVersion;
    }
    if (
      this.app.extConfig &&
      this.app.extConfig.ios &&
      this.app.extConfig.ios.minVersion
    ) {
      this.ios.minVersion = this.app.extConfig.ios.minVersion;
    }
  }

  private initWindowsConfig() {
    if (this.cli.os !== OS.Windows) {
      return;
    }
    this.windows.androidStudioPath = this.app.windowsAndroidStudioPath;
  }

  private initLinuxConfig() {
    if (this.app.linuxAndroidStudioPath) {
      this.linux.androidStudioPath = this.app.linuxAndroidStudioPath;
    }
  }

  private mergeConfigData() {
    const extConfig: ExternalConfig = this.app.extConfig || {};

    Object.assign(this.app, extConfig);

    // Build the absolute path to the web directory
    this.app.webDirAbs = resolve(this.app.rootDir, this.app.webDir);
  }

  loadExternalConfig() {
    this.app.extConfigFilePath = join(this.app.rootDir, this.app.extConfigName);

    try {
      const extConfigStr = readFileSync(this.app.extConfigFilePath, 'utf8');

      try {
        // we've got an capacitor.json file, let's parse it
        this.app.extConfig = JSON.parse(extConfigStr);
      } catch (e) {
        logFatal(
          `error parsing: ${basename(this.app.extConfigFilePath)}\n ${
            e.stack ? e.stack : e
          }`,
        );
      }
    } catch {
      // it's ok if there's no capacitor.json file
    }
  }

  foundExternalConfig(): boolean {
    return !!this.app.extConfig;
  }

  selectPlatforms(selectedPlatformName?: string) {
    if (selectedPlatformName) {
      // already passed in a platform name
      const platformName = selectedPlatformName.toLowerCase().trim();

      if (!this.isValidPlatform(platformName)) {
        logFatal(`Invalid platform: ${platformName}`);
      } else if (!this.platformDirExists(platformName)) {
        this.platformNotCreatedError(platformName);
      }

      // return the platform in an string array
      return [platformName];
    }

    // wasn't given a platform name, so let's
    // get the platforms that have already been created
    return this.getExistingPlatforms();
  }

  async askPlatform(
    selectedPlatformName: string,
    promptMessage: string,
  ): Promise<string> {
    if (!selectedPlatformName) {
      const answers = await prompts(
        [
          {
            type: 'select',
            name: 'mode',
            message: promptMessage,
            choices: this.knownPlatforms.map(p => ({ title: p, value: p })),
          },
        ],
        { onCancel: () => process.exit(1) },
      );

      return answers.mode.toLowerCase().trim();
    }

    const platformName = selectedPlatformName.toLowerCase().trim();

    if (!this.isValidPlatform(platformName)) {
      logFatal(
        `Invalid platform: "${platformName}". Valid platforms include: ${this.knownPlatforms.join(
          ', ',
        )}`,
      );
    }

    return platformName;
  }

  getExistingPlatforms() {
    const platforms: string[] = [];

    if (this.platformDirExists(this.android.name)) {
      platforms.push(this.android.name);
    }

    if (this.platformDirExists(this.ios.name)) {
      platforms.push(this.ios.name);
    }

    platforms.push(this.web.name);

    return platforms;
  }

  platformDirExists(platformName: any): string {
    let platformDir: any = null;

    try {
      let testDir = join(this.app.rootDir, platformName);
      if (platformName === 'web') {
        testDir = this.app.webDirAbs;
      }
      accessSync(testDir);
      platformDir = testDir;
    } catch (e) {}

    return platformDir;
  }

  isValidPlatform(platform: any) {
    return this.knownPlatforms.includes(platform);
  }

  platformNotCreatedError(platformName: string) {
    if (platformName === 'web') {
      logFatal(
        `Could not find the web platform directory. Make sure ${kleur.bold(
          this.app.webDir,
        )} exists.`,
      );
    }
    logFatal(
      `${kleur.bold(
        platformName,
      )}" platform has not been created. Use "npx cap add ${platformName}" to add the platform project.`,
    );
  }
}

function loadPackageJson(dir: string): PackageJson {
  let p: any = null;

  try {
    p = require(join(dir, 'package.json'));
  } catch (e) {}

  return p;
}
