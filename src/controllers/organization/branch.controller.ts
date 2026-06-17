import { NextFunction, Request, Response } from "express";
import { BranchModel } from "../../infrastructure/database/models";
import { status } from "../../types/types";
import { ApiResponse } from "../../shared/response/api-response";

export const createBranch = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            name,
            address,
            shiftApplicable,
            branchType,
        } = req.body;

        const companyId =
            req.user!.companyId;

        if (
            branchType ===
            "HEAD_OFFICE"
        ) {
            const headOffice =
                await BranchModel.findOne({
                    companyId,
                    branchType:
                        "HEAD_OFFICE",
                    status: {
                        $ne: "DELETED" as status,
                    },
                });

            if (headOffice) {
                return res.status(400).json(
                    ApiResponse.error(
                        "Head office already exists"
                    )
                );
            }
        }

        const branch =
            await BranchModel.create({
                companyId,
                name,
                address,
                shiftApplicable,
                branchType,
            });

        return res.status(201).json(
            ApiResponse.success(
                branch,
                "Branch created successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};


export const getBranches = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const page =
            Number(req.query.page) || 1;

        const limit =
            Number(req.query.limit) || 10;

        const skip =
            (page - 1) * limit;

        const search =
            req.query.search?.toString() ||
            "";

        const status =
            req.query.status?.toString();

        const filter: any = {
            companyId:
                req.user!.companyId,
        };

        if (search) {
            filter.name = {
                $regex: search,
                $options: "i",
            };
        }

        if (status) {
            filter.status = status;
        }

        const [branches, total] =
            await Promise.all([
                BranchModel.find(filter)
                    .sort({
                        createdAt: -1,
                    })
                    .skip(skip)
                    .limit(limit)
                    .lean(),

                BranchModel.countDocuments(
                    filter
                ),
            ]);

        return res.status(200).json(
            ApiResponse.success(
                {
                    branches,
                    total
                },
                "Branches fetched successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};


export const getBranchById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const branch =
            await BranchModel.findOne({
                _id: req.params.branchId,
                companyId:
                    req.user!.companyId,
            });

        if (!branch) {
            return res.status(404).json(
                ApiResponse.error(
                    "Branch not found"
                )
            );
        }

        return res.status(200).json(
            ApiResponse.success(
                branch,
                "Branch fetched successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};


export const updateBranch = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const branch =
            await BranchModel.findOne({
                _id: req.params.branchId,
                companyId:
                    req.user!.companyId,
            });

        if (!branch) {
            return res.status(404).json(
                ApiResponse.error(
                    "Branch not found"
                )
            );
        }

        const {
            name,
            address,
            shiftApplicable,
            branchType
        } = req.body;

        if (name !== undefined)
            branch.name = name;

        if (address !== undefined)
            branch.address = address;

        if (
            shiftApplicable !==
            undefined
        )
            branch.shiftApplicable =
                shiftApplicable;

        if (
            branchType ===
            "HEAD_OFFICE"
        ) {
            const headOffice =
                await BranchModel.findOne({
                    _id: { $ne: req.params.branchId },
                    companyId: branch.companyId,
                    branchType:
                        "HEAD_OFFICE",
                    status: {
                        $ne: "DELETED" as status,
                    },
                });

            if (headOffice) {
                return res.status(400).json(
                    ApiResponse.error(
                        "Head office already exists"
                    )
                );
            }
            branch.branchType = branchType;
        }

        await branch.save();

        return res.status(200).json(
            ApiResponse.success(
                branch,
                "Branch updated successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};


export const updateBranchStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { status } =
            req.body;

        const branch =
            await BranchModel.findOne({
                _id: req.params.branchId,
                companyId:
                    req.user!
                        .companyId,
            });

        if (!branch) {
            return res
                .status(404)
                .json(
                    ApiResponse.error(
                        "Branch not found"
                    )
                );
        }

        branch.status = status;

        await branch.save();

        return res
            .status(200)
            .json(
                ApiResponse.success(
                    null,
                    "Status updated successfully"
                )
            );
    } catch (error) {
        next(error);
    }
};