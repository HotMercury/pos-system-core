export class InvalidStateTransitionError extends Error {
    constructor(public from: string, public to: string) {
        super(`Cannot transition from ${from} to ${to}`);
        this.name = "InvalidStateTransitionError";
    }
}