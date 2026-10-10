/** JST03:00 is UTC18:00. This maintenance operation has no public HTTP route. */
export const RESET_CRON = '0 18 * * *';
export async function resetDatabase(db:D1Database):Promise<void>{
 // Assignment references restrict partner deletion: clear them first in the same transaction.
 // SESSION cascading foreign keys remove every session-owned row, including manual workloads.
 // An old owner's subsequent guarded write cannot recreate a removed SESSION.
 await db.batch([db.prepare('DELETE FROM ASSIGNMENT'),db.prepare('DELETE FROM SESSION')]);
}

export async function scheduledReset(controller:ScheduledController,env:{DB:D1Database}):Promise<void>{
 if(controller.cron!==RESET_CRON)throw new Error('Unexpected reset schedule');
 await resetDatabase(env.DB);
}
