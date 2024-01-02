//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";

/// @title ERC-20 Non-Fungible Token Standard, optional metadata extension
/// @dev See https://eips.ethereum.org/EIPS/eip-20
contract MyERC20Token {

    string  public name;
    string  public symbol;
    uint    public immutable decimals;
    uint256 public immutable totalSupply;

    mapping (address =>  uint256) public balance;
    mapping (address =>  mapping (address => uint)) public allowance;

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    /// @param _totalSupply  initial supply of token
    /// @param _name         token name
    /// @param _symbol       token symbol
    /// @param _decimals     token decimals
    constructor(string memory _name, string memory _symbol, uint256 _decimals, uint256 _totalSupply) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _totalSupply;
        balance[msg.sender] = totalSupply;

        console.log(
            "Creating contract %s %s %d", name, symbol, decimals);
        console.log(
            "total supply %d", totalSupply);
    }

    function balanceOf  (address _owner) public view returns (uint256) {
        return balance[_owner];
    }


    function transfer(address _to, uint256 _value) public returns (bool success)  {
        console.log(
            "Transferring from %s to %s %s tokens",
            msg.sender,
            _to,
            _value
        );

        require(balance[msg.sender] >= _value);
        balance[msg.sender] -= _value;
        balance[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function approve(address _spender, uint256 _value) public returns (bool success) {
        console.log(
            "Approving %s to spend %s tokens on behalf of %s",
            _spender,
            _value,
            msg.sender
        );

        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        require(balance[msg.sender] >= _value);
        require(allowance[_from][msg.sender] >= _value);
        allowance[_from][msg.sender] -= _value;
        balance[msg.sender] -= _value;
        balance[_to] += _value;
        emit Transfer(_from, _to, _value);
        return true;
    }
}

