const fs = require("fs");
const path = require("path");

// Configuration
const VEGA_PATH = "D:\\Work\\Vega";

/**
 * Clean version string by removing prefixes like ^, ~, etc.
 */
function cleanVersion(version) {
  return version.replace(/^[\^~>=<]/, "");
}

/**
 * Compare two version strings to determine which is higher
 */
function isVersionHigher(version1, version2) {
  const v1Parts = version1.split(".").map(Number);
  const v2Parts = version2.split(".").map(Number);

  const maxLength = Math.max(v1Parts.length, v2Parts.length);

  for (let i = 0; i < maxLength; i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part > v2Part) return true;
    if (v1Part < v2Part) return false;
  }

  return false; // Versions are equal
}

/**
 * Process a group of dependencies (dependencies or devDependencies)
 */
function processDependencyGroup(deps, targetMap) {
  for (const [name, version] of Object.entries(deps)) {
    const cleanVersionStr = cleanVersion(version);

    if (targetMap.has(name)) {
      const existingVersion = targetMap.get(name);
      if (isVersionHigher(cleanVersionStr, existingVersion)) {
        targetMap.set(name, cleanVersionStr);
      }
    } else {
      targetMap.set(name, cleanVersionStr);
    }
  }
}

/**
 * Recursively find all projects with package.json files
 */
function findProjects(dir) {
  const projects = [];

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const packageJsonPath = path.join(fullPath, "package.json");
        if (fs.existsSync(packageJsonPath)) {
          projects.push(fullPath);
        } else {
          projects.push(...findProjects(fullPath));
        }
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
  }

  return projects;
}

/**
 * Process a single project's package.json
 */
function processProject(projectPath, dependencies, devDependencies) {
  const packageJsonPath = path.join(projectPath, "package.json");

  try {
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent);

    if (packageJson.dependencies) {
      processDependencyGroup(packageJson.dependencies, dependencies);
    }

    if (packageJson.devDependencies) {
      processDependencyGroup(packageJson.devDependencies, devDependencies);
    }
  } catch (error) {
    console.warn(
      `Warning: Could not process ${packageJsonPath}: ${error.message}`
    );
  }
}

/**
 * Generate the final result object
 */
function generateResult(dependencies, devDependencies, vegaPath) {
  // Convert Map to object with dependency_name: version format
  // Add ^ prefix to all versions
  const dependenciesObj = {};
  for (const [name, version] of dependencies) {
    dependenciesObj[name] = `^${version}`;
  }

  const devDependenciesObj = {};
  for (const [name, version] of devDependencies) {
    devDependenciesObj[name] = `^${version}`;
  }

  return {
    scanDate: new Date().toISOString(),
    vegaPath,
    totalProjects: findProjects(vegaPath).length,
    dependencies: dependenciesObj,
    devDependencies: devDependenciesObj,
    summary: {
      totalDependencies: dependencies.size,
      totalDevDependencies: devDependencies.size,
    },
  };
}

/**
 * Save the result to list.json
 */
function saveResult(result) {
  const outputPath = path.join(__dirname, "list.json");
  const jsonContent = JSON.stringify(result, null, 2);

  fs.writeFileSync(outputPath, jsonContent, "utf8");
  console.log(`Results saved to: ${outputPath}`);
}

/**
 * Main function to scan projects and generate dependency list
 */
async function scanProjects() {
  try {
    console.log(`Scanning projects in: ${VEGA_PATH}`);

    if (!fs.existsSync(VEGA_PATH)) {
      throw new Error(`Vega folder not found at: ${VEGA_PATH}`);
    }

    const projects = findProjects(VEGA_PATH);
    console.log(`Found ${projects.length} projects with package.json files`);

    const dependencies = new Map();
    const devDependencies = new Map();

    for (const projectPath of projects) {
      console.log(`Processing: ${projectPath}`);
      processProject(projectPath, dependencies, devDependencies);
    }

    const result = generateResult(dependencies, devDependencies, VEGA_PATH);
    saveResult(result);

    console.log("Dependency scanning completed successfully!");
    console.log(
      `Found ${Object.keys(result.dependencies).length} dependencies and ${
        Object.keys(result.devDependencies).length
      } devDependencies`
    );
  } catch (error) {
    console.error("Error during scanning:", error.message);
    process.exit(1);
  }
}

// Run the scanner
scanProjects();
