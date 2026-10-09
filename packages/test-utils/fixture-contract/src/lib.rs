#![no_std]
//! Fixture contract for Soroscope's tests. It exists to produce real, on-chain
//! behaviour that is awkward to find in the wild on demand: named contract errors,
//! auth-requiring calls, typed events, all three storage durabilities, a panic,
//! and two tunable costs (`work`, `touch`) so resource regressions can be
//! measured against a genuine difference.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, Symbol,
};

/// Errors the contract can return. Numeric codes are part of its interface.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// No value is stored under that key.
    NotFound = 1,
    /// The sender does not hold enough funds.
    InsufficientFunds = 2,
    /// The caller is not allowed to do that.
    Unauthorized = 3,
    /// An argument is out of range or the contract is already set up.
    Invalid = 4,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
    Item(Symbol),
    Scratch(Symbol),
    Counter(u32),
}

/// Emitted by `move_funds`.
#[contractevent]
pub struct Moved {
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub amount: i128,
}

/// Emitted by `emit`.
#[contractevent]
pub struct Tick {
    #[topic]
    pub index: u32,
    pub value: i128,
}

#[contract]
pub struct Fixture;

#[contractimpl]
impl Fixture {
    /// One-time setup: record the admin.
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::Invalid);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Credit `to` with `amount`. Admin only.
    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotFound)?;
        admin.require_auth();
        if amount <= 0 {
            return Err(Error::Invalid);
        }
        let key = DataKey::Balance(to);
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current + amount));
        Ok(())
    }

    /// Balance held by `who` (zero if none).
    pub fn balance(env: Env, who: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Balance(who)).unwrap_or(0)
    }

    /// Move funds. Needs `from`'s authorization and emits a `Moved` event.
    pub fn move_funds(env: Env, from: Address, to: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::Invalid);
        }
        let from_key = DataKey::Balance(from.clone());
        let balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if balance < amount {
            return Err(Error::InsufficientFunds);
        }
        env.storage().persistent().set(&from_key, &(balance - amount));
        let to_key = DataKey::Balance(to.clone());
        let to_balance: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);
        env.storage().persistent().set(&to_key, &(to_balance + amount));
        Moved { from, to, amount }.publish(&env);
        Ok(())
    }

    /// Store a value in persistent storage.
    pub fn put(env: Env, key: Symbol, val: i128) {
        env.storage().persistent().set(&DataKey::Item(key), &val);
    }

    /// Store a value in temporary storage.
    pub fn put_temp(env: Env, key: Symbol, val: i128) {
        env.storage().temporary().set(&DataKey::Scratch(key), &val);
    }

    /// Read a persistent value.
    pub fn get(env: Env, key: Symbol) -> Result<i128, Error> {
        env.storage().persistent().get(&DataKey::Item(key)).ok_or(Error::NotFound)
    }

    /// Return the error with this code (1 to 4); any other value succeeds.
    pub fn fail_with(_env: Env, code: u32) -> Result<(), Error> {
        match code {
            1 => Err(Error::NotFound),
            2 => Err(Error::InsufficientFunds),
            3 => Err(Error::Unauthorized),
            4 => Err(Error::Invalid),
            _ => Ok(()),
        }
    }

    /// Panic outright, producing a host-level error instead of a contract error.
    pub fn boom(_env: Env) {
        panic!("boom");
    }

    /// CPU cost knob: burns instructions in proportion to `n`.
    ///
    /// Each round depends on the previous one through a rotate and xor, so the
    /// compiler cannot collapse the loop into a closed-form expression (an
    /// earlier plain-sum version did, and cost the same for any `n`).
    pub fn work(_env: Env, n: u32) -> u64 {
        let mut acc: u64 = 0x9E37_79B9_7F4A_7C15;
        let mut i: u32 = 0;
        while i < n {
            acc = acc.rotate_left(5) ^ acc.wrapping_mul(0xBF58_476D_1CE4_E5B9).wrapping_add(i as u64);
            i += 1;
        }
        acc
    }

    /// Footprint/write cost knob: writes `n` persistent entries.
    pub fn touch(env: Env, n: u32) {
        let mut i: u32 = 0;
        while i < n {
            env.storage().persistent().set(&DataKey::Counter(i), &i);
            i += 1;
        }
    }

    /// Emit `n` typed events.
    pub fn emit(env: Env, n: u32) {
        let mut i: u32 = 0;
        while i < n {
            Tick { index: i, value: i as i128 }.publish(&env);
            i += 1;
        }
    }
}
