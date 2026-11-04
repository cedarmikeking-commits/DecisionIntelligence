import { getDB, query } from './db';

async function checkMajors() {
  await getDB();
  console.log('sys_majors:', query('SELECT * FROM sys_majors'));
  console.log('majors:', query('SELECT * FROM majors'));
}

checkMajors();