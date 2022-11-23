// std
import { execSync, spawn, SpawnOptions } from 'child_process';

// 3p
import { red } from 'colors/safe';

// FoalTS
import { FileSystem } from '../../file-system';
import {
  getNames,
  initGitRepo,
  logger,
} from '../../utils';

function isYarnInstalled() {
  try {
    execSync('yarn --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function createApp({ name, autoInstall, initRepo, mongodb = false, yaml = false }:
  { name: string, autoInstall?: boolean, initRepo?: boolean, mongodb?: boolean,
    yaml?: boolean }) {
  const names = getNames(name);

  logger.log();
  logger.log(' ------------------------------------------------- ');
  logger.log('|                                                 |');
  logger.log('|                     Foal                        |');
  logger.log('|                                                 |');
  logger.log(' ------------------------------------------------- ');

  const locals = names;

  const fs = new FileSystem();

  if (fs.exists(names.kebabName)) {
    logger.log();
    logger.log(red('  Error: ') + `The target directory "${names.kebabName}" already exists.`);
    logger.log('Please remove it before proceeding.');
    logger.log();
    return;
  }

  fs
    .ensureDir(names.kebabName)
    .cd(names.kebabName);

  logger.log();
  logger.log('  📂 Creating files...');

  fs
    .hideLogs()
    .copy('app/gitignore', '.gitignore')
    .renderOnlyIf(!mongodb, 'app/package.json', 'package.json', locals)
    .renderOnlyIf(mongodb, 'app/package.mongodb.json', 'package.json', locals)
    .setOrUpdateProjectDependencyOnlyIf(yaml, 'yamljs', '~0.3.0')
    .copy('app/tsconfig.app.json', 'tsconfig.app.json')
    .copy('app/tsconfig.e2e.json', 'tsconfig.e2e.json')
    .copy('app/tsconfig.json', 'tsconfig.json')
    .copy('app/tsconfig.test.json', 'tsconfig.test.json')
    .copy('app/.eslintrc.js', '.eslintrc.js')
      // Config
      .ensureDir('config')
      .cd('config')
      .renderOnlyIf(!mongodb && !yaml, 'app/config/default.json', 'default.json', locals)
      .renderOnlyIf(!mongodb && yaml, 'app/config/default.yml', 'default.yml', locals)
      .renderOnlyIf(mongodb && !yaml, 'app/config/default.mongodb.json', 'default.json', locals)
      .renderOnlyIf(mongodb && yaml, 'app/config/default.mongodb.yml', 'default.yml', locals)
      .renderOnlyIf(!yaml, 'app/config/development.json', 'development.json', locals)
      .renderOnlyIf(yaml, 'app/config/development.yml', 'development.yml', locals)
      .renderOnlyIf(!mongodb && !yaml, 'app/config/e2e.json', 'e2e.json', locals)
      .renderOnlyIf(!mongodb && yaml, 'app/config/e2e.yml', 'e2e.yml', locals)
      .renderOnlyIf(mongodb && !yaml, 'app/config/e2e.mongodb.json', 'e2e.json', locals)
      .renderOnlyIf(mongodb && yaml, 'app/config/e2e.mongodb.yml', 'e2e.yml', locals)
      .renderOnlyIf(!yaml, 'app/config/production.json', 'production.json', locals)
      .renderOnlyIf(yaml, 'app/config/production.yml', 'production.yml', locals)
      .renderOnlyIf(!mongodb && !yaml, 'app/config/test.json', 'test.json', locals)
      .renderOnlyIf(!mongodb && yaml, 'app/config/test.yml', 'test.yml', locals)
      .renderOnlyIf(mongodb && !yaml, 'app/config/test.mongodb.json', 'test.json', locals)
      .renderOnlyIf(mongodb && yaml, 'app/config/test.mongodb.yml', 'test.yml', locals)
      .cd('..')
      // Public
      .ensureDir('public')
      .cd('public')
      .copy('app/public/index.html', 'index.html')
      .copy('app/public/logo.png', 'logo.png')
      .cd('..')
      // Src
      .ensureDir('src')
      .cd('src')
      .copy('app/src/db.ts', 'db.ts')
      .copy('app/src/e2e.ts', 'e2e.ts')
      .copy('app/src/index.ts', 'index.ts')
      .copy('app/src/test.ts', 'test.ts')
        // App
        .ensureDir('app')
        .cd('app')
        .copy('app/src/app/app.controller.ts', 'app.controller.ts')
          // Controllers
          .ensureDir('controllers')
          .cd('controllers')
          .copy('app/src/app/controllers/index.ts', 'index.ts')
          .copy('app/src/app/controllers/api.controller.ts', 'api.controller.ts')
          .copy('app/src/app/controllers/api.controller.spec.ts', 'api.controller.spec.ts')
          .cd('..')
          // Entities
          .ensureDir('entities')
          .cd('entities')
          .copy('app/src/app/entities/index.ts', 'index.ts')
          .copyOnlyIf(!mongodb, 'app/src/app/entities/user.entity.ts', 'user.entity.ts')
          .copyOnlyIf(mongodb, 'app/src/app/entities/user.entity.mongodb.ts', 'user.entity.ts')
          .cd('..')
          // Hooks
          .ensureDir('hooks')
          .cd('hooks')
          .copy('app/src/app/hooks/index.ts', 'index.ts')
          .cd('..')
          // Services
          .ensureDir('services')
          .cd('services')
          .copy('app/src/app/services/index.ts', 'index.ts')
          .cd('..')
        .cd('..')
        // E2E
        .ensureDir('e2e')
        .cd('e2e')
        .copy('app/src/e2e/index.ts', 'index.ts')
        .cd('..')
        // Scripts
        .ensureDir('scripts')
        .cd('scripts')
        .copy('app/src/scripts/create-user.ts', 'create-user.ts');

  if (autoInstall) {
    const packageManager = isYarnInstalled() ? 'yarn' : 'npm';

    logger.log();
    const spinner = logger.log(`%s 📦 Installing dependencies (${packageManager})...`, true);

    const args = [ 'install' /*, '--ignore-engines'*/ ];
    const options: SpawnOptions = {
      cwd: names.kebabName,
      shell: true,
      stdio: 'ignore',
    };

    const success = await new Promise(resolve => {
      spawn(packageManager, args, options)
        .on('close', (code: number) => resolve(code === 0));
    });

    if (spinner) {
      spinner.stop(true);
    }

    if (!success) {
      logger.log(`  ❗ Installing dependencies (${packageManager})...`);
      logger.log();
      logger.log(red('  Error: ') + 'A problem occurred during the installation of');
      logger.log('the dependencies. Try installing them manually by running');
      logger.log('the following commands:');
      logger.log();
      logger.logCommand(`cd ${names.kebabName}`);
      logger.logCommand(`${packageManager} install`);
      logger.log();
      return;
    } else {
      logger.log(`  📦 Installing dependencies (${packageManager})...`);
    }

  }

  if (initRepo) {
    logger.log();
    logger.log('  📔 Initializing git repository...');
    await initGitRepo(names.kebabName);
  }

  logger.log();
  logger.log('✨ Project successfully created.');
  logger.log('👉 Here are the next steps:');

  logger.log();
  logger.logCommand(`cd ${names.kebabName}`);
  if (!autoInstall) {
    logger.logCommand('npm install');
  }
  logger.logCommand('npm run dev');

  logger.log();
}
