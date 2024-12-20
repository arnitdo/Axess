import { ORGS_DEVICE_COLLECTION_NAME, ORGS_DOC_COLLECTION_NAME, ORGS_USERS_COLLECTION_NAME } from "@/utils/common";
import {
	CustomApiRequest,
	CustomApiResponse,
	requireBodyParams,
	requireBodyValidators,
	requireMethods,
	requireMiddlewareChecks,
	requireValidBody,
} from "@/utils/customMiddleware";
import { db } from "@/utils/db";
import { UserPermissionLevel } from "@/utils/types";
import { CreateOrgBody } from "@/utils/types/apiRequests";
import { STRLEN_NZ, VALID_ORG_ID } from "@/utils/validatorUtils";
import { hash } from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export default async function createOrg(req: CustomApiRequest<CreateOrgBody>, res: CustomApiResponse) {
	const middlewareStatus = await requireMiddlewareChecks(req, res, {
		[requireMethods.name]: requireMethods("POST"),
		// [requireAuthenticatedUser.name]: requireAuthenticatedUser(),
		// [requirePermissionLevel.name]: requirePermissionLevel(UserPermissionLevel.SUPERUSER),
		[requireValidBody.name]: requireValidBody(),
		[requireBodyParams.name]: requireBodyParams("orgName", "adminCredentials"),
		[requireBodyValidators.name]: requireBodyValidators({
			orgName: async (orgName: string) => {
				return !(await VALID_ORG_ID(orgName));
			},
			adminCredentials: (creds: CreateOrgBody["adminCredentials"]) => {
				const { userId, userPass } = creds;
				return STRLEN_NZ(userId) && STRLEN_NZ(userPass);
			},
		}),
	});

	if (!middlewareStatus) return;

	const {
		orgName,
		adminCredentials: { userId, userPass },
	} = req.body;
	const orgsCollection = db.collection(ORGS_DOC_COLLECTION_NAME);
	const createdDoc = orgsCollection.doc(orgName);

	await createdDoc.set({
		creationTimestamp: new Date(),
	});

	const createdDeviceCollection = createdDoc.collection(ORGS_DEVICE_COLLECTION_NAME);
	const createdUsersCollection = createdDoc.collection(ORGS_USERS_COLLECTION_NAME);

	const encodedPassword = await hash(userPass, 10);

	const createdUserUUID = uuidv4();
	const createdUserDoc = createdUsersCollection.doc(createdUserUUID);
	await createdUserDoc.set({
		userId,
		userPass: encodedPassword,
		permissionLevel: UserPermissionLevel.ADMINISTRATOR,
	});

	return res.status(200).json({
		requestStatus: "SUCCESS",
	});
}
