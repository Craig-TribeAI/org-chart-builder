import Papa from 'papaparse';

// Department configuration with fixed row ranges from the CSV
const DEPARTMENT_CONFIG = [
  { name: 'Execs', startRow: 17, endRow: 21, color: '#3B82F6' },
  { name: 'Sales', startRow: 23, endRow: 31, color: '#10B981' },
  { name: 'Delivery', startRow: 33, endRow: 46, color: '#F59E0B', excludeRows: [35] }, // Exclude row 35 (Head of AI Engineering) - duplicate with Product AI Lead
  { name: 'Partnerships + Marketing', startRow: 48, endRow: 57, color: '#EC4899', excludeRows: [51] }, // Exclude row 51 (Product / Branding Marketing) - belongs to Product
  { name: 'Product + Eng - Foundry', startRow: 59, endRow: 69, color: '#8B5CF6' },
  { name: 'Ops / Other', startRow: 71, endRow: 78, color: '#6B7280' }
];

// Column indices for 2026 quarterly data
const Q1_COL = 9;
const Q2_COL = 10;
const Q3_COL = 11;
const Q4_COL = 12;
const COST_COL = 2;

/**
 * Clean role name by removing asterisks, parentheses content, and trimming
 */
function cleanRoleName(name) {
  if (!name) return '';

  return name
    .replace(/\*/g, '')           // Remove asterisks
    .replace(/\([^)]*\)/g, '')    // Remove parentheses and content
    .trim();                       // Trim whitespace
}

/**
 * Parse headcount value from CSV cell
 */
function parseHeadcount(value) {
  if (!value || value === '') return 0;
  const num = parseInt(value, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Check if a row is a cost summary row (should be skipped)
 */
function isCostRow(roleName) {
  if (!roleName) return true;
  return roleName.toLowerCase().includes('cost of');
}

/**
 * Parse CSV file and extract departments and role templates
 * @param {File} file - The CSV file to parse
 * @returns {Promise<{departments: Array, roleTemplates: Array}>}
 */
export function parseOrgChartCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        try {
          const parsed = processCSVData(results.data);
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
      skipEmptyLines: false // Keep empty lines to detect section boundaries
    });
  });
}

/**
 * Process parsed CSV data into departments and role templates
 */
function processCSVData(rows) {
  const departments = [];
  const roleTemplates = [];

  console.log('🔍 CSV Parser - Starting to process CSV data');
  let totalQ1 = 0, totalQ2 = 0, totalQ3 = 0, totalQ4 = 0;

  // Process each department
  DEPARTMENT_CONFIG.forEach((deptConfig, deptIndex) => {
    // Create department object
    const department = {
      id: `dept-${deptIndex}`,
      name: deptConfig.name,
      displayName: deptConfig.name,
      color: deptConfig.color,
      startRow: deptConfig.startRow,
      endRow: deptConfig.endRow,
      order: deptIndex
    };
    departments.push(department);

    console.log(`\n📊 Processing ${deptConfig.name} (rows ${deptConfig.startRow}-${deptConfig.endRow})`);

    // Extract roles in this department's row range
    for (let rowIdx = deptConfig.startRow; rowIdx <= deptConfig.endRow; rowIdx++) {
      // Skip explicitly excluded rows
      if (deptConfig.excludeRows && deptConfig.excludeRows.includes(rowIdx)) {
        console.log(`  ⏭️  Row ${rowIdx}: Excluded by configuration (see comment in DEPARTMENT_CONFIG)`);
        continue;
      }

      // Convert to 0-based index
      const row = rows[rowIdx - 1];

      if (!row || !row[0]) {
        console.log(`  ⏭️  Row ${rowIdx}: Empty, skipping`);
        continue;
      }

      const roleName = row[0];

      // Skip cost summary rows
      if (isCostRow(roleName)) {
        console.log(`  ⏭️  Row ${rowIdx}: Cost row "${roleName}", skipping`);
        continue;
      }

      // Skip department header rows (they don't have cost data)
      const hasCostData = row[COST_COL] && row[COST_COL].trim() !== '';
      if (!hasCostData) {
        console.log(`  ⏭️  Row ${rowIdx}: No cost data "${roleName}", skipping`);
        continue;
      }

      // Parse quarterly headcount
      const q1 = parseHeadcount(row[Q1_COL]);
      const q2 = parseHeadcount(row[Q2_COL]);
      const q3 = parseHeadcount(row[Q3_COL]);
      const q4 = parseHeadcount(row[Q4_COL]);

      // Only add role if it has headcount in at least one quarter
      if (q1 === 0 && q2 === 0 && q3 === 0 && q4 === 0) {
        console.log(`  ⏭️  Row ${rowIdx}: "${roleName}" has 0 headcount in all quarters, skipping`);
        continue;
      }

      console.log(`  ✅ Row ${rowIdx}: "${roleName}" - Q1:${q1} Q2:${q2} Q3:${q3} Q4:${q4}`);
      totalQ1 += q1;
      totalQ2 += q2;
      totalQ3 += q3;
      totalQ4 += q4;

      const roleTemplate = {
        id: `role-${rowIdx}`,
        originalName: roleName,
        cleanName: cleanRoleName(roleName),
        department: deptConfig.name,
        departmentId: department.id,
        quarters: {
          Q1: q1,
          Q2: q2,
          Q3: q3,
          Q4: q4
        },
        costPerRole: row[COST_COL] || '',
        metadata: {
          rowIndex: rowIdx,
          hasAsterisk: roleName.includes('*'),
          hasParentheses: /\([^)]*\)/.test(roleName)
        }
      };

      roleTemplates.push(roleTemplate);
    }
  });

  console.log(`\n📈 TOTALS: Q1=${totalQ1}, Q2=${totalQ2}, Q3=${totalQ3}, Q4=${totalQ4}`);
  console.log(`📦 Generated ${roleTemplates.length} role templates`);

  return {
    departments,
    roleTemplates
  };
}

/**
 * Get total headcount for a specific quarter
 */
export function getTotalHeadcount(roleTemplates, quarter) {
  return roleTemplates.reduce((total, template) => {
    return total + (template.quarters[quarter] || 0);
  }, 0);
}

/**
 * Get headcount by department for a specific quarter
 */
export function getHeadcountByDepartment(roleTemplates, departments, quarter) {
  return departments.map(dept => {
    const deptRoles = roleTemplates.filter(r => r.departmentId === dept.id);
    const count = deptRoles.reduce((sum, role) => sum + (role.quarters[quarter] || 0), 0);
    return {
      departmentId: dept.id,
      departmentName: dept.displayName,
      count
    };
  });
}
