export function configuredAdminUserIds(){
  return new Set(
    (process.env.GRINDLOBBY_ADMIN_USER_IDS??"")
      .split(",")
      .map(value=>value.trim())
      .filter(Boolean),
  );
}

export function isConfiguredAdmin(userId:string){
  return configuredAdminUserIds().has(userId);
}
