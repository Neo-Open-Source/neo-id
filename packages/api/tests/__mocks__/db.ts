// Mock database for unit tests

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function createMockModel(name: string) {
  const store: any[] = [];

  function matchesWhere(item: any, where: any): boolean {
    if (!where) return true;
    return Object.entries(where).every(([key, value]) => {
      if (typeof value === "object" && value !== null) {
        // Handle operators like { gt: Date }
        return true; // Simplified - accept all
      }
      return item[key] === value;
    });
  }

  return {
    findUnique: async (args: any) => {
      const where = args?.where || args;
      return store.find((item) => matchesWhere(item, where)) || null;
    },
    findMany: async (args: any) => {
      const where = args?.where || {};
      let result = store.filter((item) => matchesWhere(item, where));
      if (args?.skip) result = result.slice(args.skip);
      if (args?.take) result = result.slice(0, args.take);
      return result;
    },
    findFirst: async (args: any) => {
      const where = args?.where || {};
      return store.find((item) => matchesWhere(item, where)) || null;
    },
    create: async (args: any) => {
      const data = args?.data || args;
      const item = {
        id: data.id || generateId(),
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
      };
      store.push(item);
      return item;
    },
    update: async (args: any) => {
      const where = args?.where || {};
      const data = args?.data || {};
      const index = store.findIndex((item) => matchesWhere(item, where));
      if (index === -1) throw new Error(`Not found in ${name}`);
      store[index] = { ...store[index], ...data, updatedAt: new Date() };
      return store[index];
    },
    updateMany: async (args: any) => {
      const where = args?.where || {};
      const data = args?.data || {};
      let count = 0;
      store.forEach((item) => {
        if (matchesWhere(item, where)) {
          Object.assign(item, data);
          count++;
        }
      });
      return { count };
    },
    delete: async (args: any) => {
      const where = args?.where || {};
      const index = store.findIndex((item) => matchesWhere(item, where));
      if (index === -1) throw new Error(`Not found in ${name}`);
      return store.splice(index, 1)[0];
    },
    deleteMany: async (args: any) => {
      const where = args?.where || {};
      if (Object.keys(where).length === 0) {
        const count = store.length;
        store.length = 0;
        return { count };
      }
      const before = store.length;
      for (let i = store.length - 1; i >= 0; i--) {
        if (matchesWhere(store[i], where)) {
          store.splice(i, 1);
        }
      }
      return { count: before - store.length };
    },
    count: async (args: any) => {
      const where = args?.where || {};
      if (Object.keys(where).length === 0) return store.length;
      return store.filter((item) => matchesWhere(item, where)).length;
    },
    upsert: async (args: any) => {
      const where = args?.where || {};
      const createData = args?.create || {};
      const updateData = args?.update || {};
      const existing = store.find((item) => matchesWhere(item, where));
      if (existing) {
        Object.assign(existing, updateData, { updatedAt: new Date() });
        return existing;
      }
      const item = {
        id: generateId(),
        ...createData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.push(item);
      return item;
    },
    _store: store,
  };
}

// Export mock db with all models
export const db = {
  user: createMockModel("user"),
  session: createMockModel("session"),
  refreshToken: createMockModel("refreshToken"),
  serviceApp: createMockModel("serviceApp"),
  identity: createMockModel("identity"),
  passkey: createMockModel("passkey"),
  oAuthState: createMockModel("oAuthState"),
  mfaCode: createMockModel("mfaCode"),
  auditLog: createMockModel("auditLog"),
  deviceCode: createMockModel("deviceCode"),
  $connect: async () => {},
  $disconnect: async () => {},
};

export default db;
