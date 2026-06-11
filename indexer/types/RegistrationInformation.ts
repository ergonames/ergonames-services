export interface RegistrationInformation {
  ergonameRegistered: string;
  ergonameTokenId: string;
  mintBoxId: string;
  mintTransactionId: string;
  spendTransactionId: string | null;
  registeredAddress: string;
  blockRegistered: number;
  timestampRegistered: number;
}
