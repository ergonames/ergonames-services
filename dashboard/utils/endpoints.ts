import { Registration } from "@/types/Registration";
import { API_BASE_URL } from "./const";
import { ApiInfo } from "@/types/ApiInfo";

export async function getLastRegistrations(limit: number): Promise<Registration[]> {
    let url: string = `${API_BASE_URL}/latest-registrations/${limit}`;
    let response: Response = await fetch(url);
    let json: Registration[] = await response.json();
    return json;
}

export async function getApiInfo(): Promise<ApiInfo> {
    let url: string = `${API_BASE_URL}/info`;
    let response: Response = await fetch(url);
    let json: ApiInfo = await response.json();
    return json;
}