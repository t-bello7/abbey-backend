import { sign, verify } from "jsonwebtoken";
import { SECRET_KEY } from "../config";
import { DataStoredInToken, TokenData } from "../interface/auth.interface";
import { User } from "../interface/users.interface";
import { DataSource, EntityRepository, Repository } from "typeorm";
import { AppDataSource } from "../database";
import { httpException } from "../exceptions/httpException";
import { compare, hash } from "bcrypt";
import { UserEntity } from "../entities/users.entity";

const createToken = (user: User, expiresIn: number = 24 * 60 * 60 * 30): TokenData => {
  const dataStoredInToken: DataStoredInToken = {
    userId: user.user_id,
  };
  const secretKey: string = String(SECRET_KEY);

  return { expiresIn, token: sign(dataStoredInToken, secretKey, { expiresIn }) };
};

const accessToken = (user: User): TokenData => {
  const dataStoredInToken: DataStoredInToken = { userId: user.user_id };
  const accessKey: string = String(SECRET_KEY);
  const expiresIn: number = 60 * 60;

  return { expiresIn, token: sign(dataStoredInToken, accessKey, { expiresIn }) };
};

const createCookie = (tokenData: TokenData): string => {
  return `Authorization=${tokenData.token}; HttpOnly; Secure; Max-Age=${tokenData.expiresIn};`;
};

export class AuthService extends Repository<UserEntity> {
  public async login(userData: User): Promise<{ cookie: string; findUser: User; accessData: string }> {
    const findUser: User[] = await AppDataSource.query(`SELECT * from user_entity WHERE email = $1`, [userData.email]);
    if (!findUser.length) throw new httpException(409, `This email ${userData.email} was not found`);

    const isPasswordMatching: boolean = await compare(userData.password, findUser[0].password);
    if (!isPasswordMatching) throw new httpException(409, "Invalid Details");

    const tokenData = createToken(findUser[0]);
    const cookie = createCookie(tokenData);
    const accessData = accessToken(findUser[0]);
    return { cookie, findUser: findUser[0], accessData: accessData.token };
  }

  public async refreshToken(token: string): Promise<{ cookie: string }> {
    const { userId } = verify(token, String(SECRET_KEY)) as unknown as DataStoredInToken;
    const foundUser = await UserEntity.findOne({ where: { user_id: userId } });

    if (!foundUser) throw new httpException(409, "User doesn't exist");

    const cookie = accessToken(foundUser);

    return { cookie: cookie.token };
  }
}
